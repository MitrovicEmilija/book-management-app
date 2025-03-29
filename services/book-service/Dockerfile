# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if it exists) to install dependencies
COPY package.json .
COPY package-lock.json* . 

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .
COPY src/proto/ ./proto/

# Expose the port your gRPC service runs on (default from your code is 50051)
EXPOSE 50051

# Command to run the gRPC server
CMD ["node", "src/server.js"]