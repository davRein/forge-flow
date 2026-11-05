ARG PYTHON_IMAGE=python:3.12-slim-bookworm
FROM ${PYTHON_IMAGE}
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY . /app
RUN find /app -type d -exec chmod 0755 {} + \
    && find /app -type f -exec chmod 0644 {} + \
    && umask 022 \
    && python -m pip install --no-cache-dir --constraint constraints.txt .
USER 10001:10001
RUN ["python", "/app/image_read_access.py", "/app", "10001"]
