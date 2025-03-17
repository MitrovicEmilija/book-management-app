package book.management.app.user_service.service;

import book.management.app.user_service.config.JwtUtils;
import book.management.app.user_service.entity.User;
import book.management.app.user_service.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class LoginService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    public String loginUser(String username, String password) {
        User user = userRepository.findByUsername(username);

        if (user != null) {
            System.out.println("Entered password: " + password);
            System.out.println("Stored (encoded) password: " + user.getPassword());

            if (passwordEncoder.matches(password, user.getPassword())) {
                return jwtUtils.generateToken(user);
            } else {
                throw new RuntimeException("Invalid credentials");
            }
        } else {
            throw new RuntimeException("User not found");
        }
    }
}
