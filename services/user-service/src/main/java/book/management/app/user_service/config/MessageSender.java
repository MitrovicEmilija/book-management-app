package book.management.app.user_service.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jms.core.JmsTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class MessageSender {
    private final JmsTemplate jmsTemplate;
    private final ObjectMapper objectMapper;

    public MessageSender(JmsTemplate jmsTemplate, ObjectMapper objectMapper) {
        this.jmsTemplate = jmsTemplate;
        this.objectMapper = objectMapper;
    }

    public void sendMessage(String destination, Map<String, Object> message) {
        try {
            String json = objectMapper.writeValueAsString(message);
            jmsTemplate.convertAndSend(destination, json);
            System.out.println("Sent to " + destination + ": " + json);
        } catch (Exception e) {
            System.err.println("Failed to send message: " + e.getMessage());
        }
    }
}
