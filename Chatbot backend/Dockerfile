# 1. Use an official Python runtime as a parent image
# Using 'slim' variant for a smaller image size
FROM python:3.12-slim

# 2. Set environment variables
# PYTHONDONTWRITEBYTECODE: Prevents Python from writing pyc files to disc
# PYTHONUNBUFFERED: Prevents Python from buffering stdout and stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. Set the working directory in the container
WORKDIR /app

# 4. Install system dependencies
# (Optional: Only needed if you use libraries that require C-compilers like psycopg2-binary)
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     build-essential \
#     && rm -rf /var/lib/apt/lists/*

# 5. Copy the requirements file into the container
COPY requirements.txt .

# 6. Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 7. Copy the rest of the application code
COPY . .

# 8. Expose the port the app runs on
EXPOSE 7860

# 9. Run the application
# ⚠️ Replace "app.main:app" with the actual path to your FastAPI app instance.
# If your main.py is in the 'app' folder, this is correct.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]