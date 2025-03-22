package book.management.app.user_service.service;

import book.management.app.user_service.entity.Role;
import book.management.app.user_service.entity.User;
import book.management.app.user_service.repository.RoleRepository;
import book.management.app.user_service.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);

    public User registerUser(String username, String email, String password, String roleName) {
        logger.debug("Attempting to register user with username: {}", username);
        Role userRole = roleRepository.findByName(roleName);
        if (userRole == null) {
            userRole = new Role();
            userRole.setName(roleName);
            roleRepository.save(userRole);
        }

        User newUser = new User();
        newUser.setUsername(username);
        newUser.setEmail(email);
        newUser.setPassword(passwordEncoder.encode(password));
        newUser.setRole(userRole);

        logger.info("User registered successfully: {}", username);
        return userRepository.save(newUser);
    }
}
