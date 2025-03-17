package book.management.app.user_service.controller;

import book.management.app.user_service.entity.User;
import book.management.app.user_service.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
public class AuthController {

    @Autowired
    private UserService userService;

    @PostMapping("/register")
    public ResponseEntity<String> registerUser(@RequestBody User user, @RequestParam(required = false) String role) {
        String userRole = (role != null && role.equals("admin")) ? "ROLE_ADMIN" : "ROLE_USER";
        User registeredUser = userService.registerUser(user.getUsername(), user.getEmail(), user.getPassword(), userRole);
        return ResponseEntity.ok("User registered successfully: " + registeredUser.getUsername());
    }
}
