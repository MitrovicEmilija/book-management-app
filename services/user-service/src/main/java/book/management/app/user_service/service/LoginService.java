package book.management.app.user_service.service;

import book.management.app.user_service.config.JwtUtils;
import book.management.app.user_service.entity.User;
import book.management.app.user_service.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class LoginService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    private static final Logger logger = LoggerFactory.getLogger(LoginService.class);

    public String loginUser(String username, String password) {
        logger.debug("Attempting to login user with username: {}", username);
        User user = userRepository.findByUsername(username);

        if (user != null) {
            System.out.println("Entered password: " + password);
            System.out.println("Stored (encoded) password: " + user.getPassword());

            if (passwordEncoder.matches(password, user.getPassword())) {
                logger.info("User logged in successfully: {}", username);
                return jwtUtils.generateToken(user);
            } else {
                throw new RuntimeException("Invalid credentials");
            }
        } else {
            throw new RuntimeException("User not found");
        }
    }

    public User findUserById(Long id) {
        return userRepository.findUserById(id);
    }
}
