# Backend Deployment Documentation

## Overview

This document provides a detailed explanation of the backend deployment process, including 
- the Continuous Deployment (CD) and Continuous Integration (CI) pipelines
- Docker images used and built
- Kubernetes deployment and configuration, environment configurations, secrets management, deployed components, jobs, and storage.

---
## Technologies Used

* **GitHub Actions**: For CI/CD automation.
* **Docker**: For containerization of the application.
* **Google Cloud Platform (GCP)**: For hosting the application and Kubernetes cluster management.
* **Kubernetes**: For container orchestration.
* **kubectl**: For Kubernetes command-line operations.
* **kustomize**: For managing Kubernetes configurations.
* **Python**: For running tests and generating code coverage reports.
* **Node.js**: For running Keycloak configuration scripts.
---
## CI Pipeline Workflow

### Trigger

The CI pipeline is triggered by:

* Push events to the `dev` or `main` branches.
* Pull requests targeting the `main` or `dev` branches.

### Jobs and Steps

The CI pipeline consists of a single job that performs the following steps:

#### Coverage Job

* **Runs-on**: `ubuntu-latest`
* **Permissions**: Grants write permissions to checks, pull-requests, and contents.

#### Steps

1. **Checkout code**
2. **Set up Python**
3. **Install dependencies**
4. **Run tests and generate coverage report**
5. **Post coverage comment to PR**
---
