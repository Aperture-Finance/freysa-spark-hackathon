ARCH ?= $(shell uname -m)
RUST_TARGET := ${ARCH}-unknown-linux-musl

ifeq ($(ARCH),aarch64)
	override ARCH=arm64
endif
ifeq ($(ARCH),x86_64)
	override ARCH=amd64
endif

# Get the absolute path to the root directory (was sovereign directory)
ROOT_DIR := $(shell readlink -m $(shell dirname $(firstword $(MAKEFILE_LIST))))
SOVEREIGN_DIR := $(ROOT_DIR)/sovereign
FINAL_BIN := $(SOVEREIGN_DIR)/bin/enclave
RELEASE_BIN := ${SOVEREIGN_DIR}/target/${RUST_TARGET}/release/enclave

DEV ?= false
DOCKERFILE := $(if $(filter true,$(DEV)),Dockerfile.dev,Dockerfile)

.PHONY: fetch-deps
fetch-deps:
	cargo fetch --manifest-path $(SOVEREIGN_DIR)/Cargo.toml --target=${RUST_TARGET}

.PHONY: build
build: fetch-deps
	@echo "Building with:"
	@echo "ARCH=$(ARCH)"
	@echo "RUST_TARGET=${RUST_TARGET}"
	@echo "Rust version: $$(rustc --version)"
	@echo "Build timestamp: $$(git log -1 --pretty=%ct)"
	rustup target install ${RUST_TARGET}
	CARGO_NET_OFFLINE=true \
	SOURCE_DATE_EPOCH=$$(git log -1 --pretty=%ct) \
	cargo build --manifest-path $(SOVEREIGN_DIR)/Cargo.toml --locked --target=${RUST_TARGET} --bin enclave --release
	@mkdir -p $(dir ${FINAL_BIN})
	cp ${RELEASE_BIN} ${FINAL_BIN}
	@echo "Binary hash:"
	@sha256sum ${FINAL_BIN}

${FINAL_BIN}: 
	@if [ ! -f bin/enclave ]; then \
		echo "Error: bin/enclave not found. Please build on EC2 first."; \
		exit 1; \
	fi
	@echo "Using pre-built binary from bin/enclave"
	@mkdir -p $(dir ${FINAL_BIN})
	@cp bin/enclave ${FINAL_BIN}
	@echo "Binary hash:"
	@sha256sum ${FINAL_BIN}

# Version from git with fallback
VERSION := $(shell cd $(ROOT_DIR)/.. && git describe --tag --dirty 2>/dev/null || echo "latest")
IMAGE_TAG := nitro-enclave:$(VERSION)
IMAGE_TAR := $(SOVEREIGN_DIR)/nitro-enclave-$(VERSION).tar

# Fix paths to be relative to root
DOCKERFILE_PATH := $(ROOT_DIR)/$(DOCKERFILE)
START_SCRIPT_PATH := $(ROOT_DIR)/start.sh
KANIKO_EXECUTOR := gcr.io/kaniko-project/executor:v1.9.2

# Only rebuild when these files change
# WARNING: Using --network=host in the Docker run command exposes the host's network stack to the container
# This can increase the risk of network-based attacks on the host system from within the container
# Ensure that only trusted users with necessary permissions can execute this command
# Use --network=host only if absolutely necessary for the application's functionality and after assessing the security implications.
$(IMAGE_TAR): $(DOCKERFILE_PATH) $(START_SCRIPT_PATH)
	docker run \
		-v $(ROOT_DIR):/workspace \
		--dns 8.8.8.8 --dns 8.8.4.4 \
		--network=host \
		$(KANIKO_EXECUTOR) \
		--context dir:///workspace \
		--dockerfile /workspace/$(DOCKERFILE) \
		--reproducible \
		--no-push \
		--tar-path /workspace/sovereign/$(notdir $(IMAGE_TAR)) \
		--destination $(IMAGE_TAG) \
		--build-arg TARGETPLATFORM=linux/$(ARCH) \
		--build-arg TARGETOS=linux \
		--build-arg TARGETARCH=$(ARCH) \
		--custom-platform linux/$(ARCH)

image: $(IMAGE_TAR)
	docker load < $(IMAGE_TAR)
	rm -f $(IMAGE_TAR)
	SOURCE_DATE_EPOCH=1704067200 \
	nitro-cli build-enclave \
		--docker-uri $(IMAGE_TAG) \
		--output-file enclave.eif \
		--name "enclave" \
		--version "1.0.0"

.PHONY: setup
setup:
	bash setup.sh

.PHONY: stop
stop:
	-sudo killall -q socat
	-nitro-cli terminate-enclave --all

.PHONY: enclave
enclave:
	bash run_enclave.sh

.PHONY: follower
follower:
	jq '.sovereign."secret-keys-from" = {"key-sync": 55995}' config.json > config.json.tmp && mv config.json.tmp config.json

.PHONY: describe
describe:
	nitro-cli describe-enclaves

.PHONY: prune
prune:
	docker system prune -af

.PHONY: restart
restart:
	sudo systemctl restart nitro-enclaves-allocator.service

