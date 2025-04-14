package book.management.app.user_service.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jms.annotation.JmsListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class MessageReceiver {
    private final ObjectMapper objectMapper;

    public MessageReceiver(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @JmsListener(destination = "book-purchases", containerFactory = "myFactory")
    public void receiveMessage(String message) {
        try {
            Map<String, Object> data = objectMapper.readValue(message, Map.class);
            if ("book_purchase".equals(data.get("event"))) {
                System.out.println("Received book purchase: userId=" + data.get("userId") + ", bookId=" + data.get("bookId"));
                // Add logic to update user transaction history
            }
        } catch (Exception e) {
            System.err.println("Error processing message: " + e.getMessage());
        }
    }
}
