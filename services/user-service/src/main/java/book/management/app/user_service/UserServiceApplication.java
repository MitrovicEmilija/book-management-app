package book.management.app.user_service;

import book.management.app.user_service.config.EnvLoader;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class UserServiceApplication {

	public static void main(String[] args) {
		EnvLoader.loadEnv();
		SpringApplication.run(UserServiceApplication.class, args);
	}

}
