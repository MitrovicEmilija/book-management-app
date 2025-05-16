package book.management.app.user_service.controller;

import book.management.app.user_service.entity.User;
import book.management.app.user_service.service.LoginService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/users")
@Tag(name = "Login", description = "Endpoints for user login")
public class LoginController {

    private static final Logger logger = LoggerFactory.getLogger(LoginController.class);

    @Autowired
    private LoginService loginService;

    @PostMapping("/login")
    @Operation(summary = "Login a user", description = "Authenticates a user and returns a JWT token")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Login successful, JWT token returned"),
            @ApiResponse(responseCode = "401", description = "Invalid credentials")
    })
    public ResponseEntity<String> loginUser(@RequestBody User user) {
        try {
            String token = loginService.loginUser(user.getUsername(), user.getPassword());
            return ResponseEntity.ok(token);
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Invalid credentials.");
        }
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID", description = "Fetches user details for the authenticated user")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "User fetched successfully"),
            @ApiResponse(responseCode = "403", description = "Access denied"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<User> getUserById(@PathVariable Long id, Authentication authentication) {
        logger.info("Fetching user with ID: {}", id);
        if (authentication == null || authentication.getDetails() == null) {
            logger.warn("No authentication details provided for user ID: {}", id);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
        }

        Map<String, Object> details = (Map<String, Object>) authentication.getDetails();
        String userId = (String) details.get("userId");
        logger.debug("Authentication details - userId: {}, roles: {}", userId, details.get("roles"));

        if (!userId.equals(String.valueOf(id))) {
            logger.warn("User ID {} attempted to access user ID {}", userId, id);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
        }

        User user = loginService.findUserById(id);
        if (user == null) {
            logger.warn("User not found for ID: {}", id);
            return ResponseEntity.notFound().build();
        }

        logger.info("Successfully fetched user: {}", user.getUsername());
        return ResponseEntity.ok(user);
    }
}
