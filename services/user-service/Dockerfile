# Use an official OpenJDK runtime as the base image
FROM openjdk:22-jdk-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the Maven wrapper and pom.xml to build the app
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Copy the source code
COPY src src

# Build the application (this will download dependencies and package the app)
RUN ./mvnw clean package -DskipTests

# Expose the port your Spring Boot app runs on (default is 8080)
EXPOSE 8080

# Run the Spring Boot application
ENTRYPOINT ["java", "-jar", "target/user-service-0.0.1-SNAPSHOT.jar"]