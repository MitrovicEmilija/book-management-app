package book.management.app.user_service.config;

import java.io.FileReader;
import java.io.IOException;
import java.util.Properties;

public class EnvLoader {
    public static void loadEnv() {
        Properties properties = new Properties();
        try (FileReader reader = new FileReader(".env")) {
            properties.load(reader);
            for (String name : properties.stringPropertyNames()) {
                System.setProperty(name, properties.getProperty(name));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}

