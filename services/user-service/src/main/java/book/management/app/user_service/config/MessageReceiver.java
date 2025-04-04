package book.management.app.user_service.config;

import org.springframework.jms.annotation.JmsListener;
import org.springframework.stereotype.Component;

@Component
public class MessageReceiver {
    @JmsListener(destination = "book-queue")
    public void receiveMessage(String message) {
        System.out.println("Received: " + message);
    }
}
