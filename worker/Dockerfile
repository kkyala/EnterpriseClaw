# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy requirements and install packages
COPY ./worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the shared common code and the application code
COPY ./common ./common
COPY ./enterprise_core ./enterprise_core
COPY ./worker/ ./

# Command to run the worker task script
CMD ["python", "-u", "app/tasks.py"]

