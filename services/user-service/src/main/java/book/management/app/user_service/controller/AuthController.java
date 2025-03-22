package book.management.app.user_service.controller;

import book.management.app.user_service.entity.User;
import book.management.app.user_service.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
@Tag(name = "Authentication", description = "Endpoints for user registration")
public class AuthController {

    @Autowired
    private UserService userService;

    @PostMapping("/register")
    @Operation(summary = "Register a new user", description = "Registers a new user with the provided details")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "User registered successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid user data")
    })
    public ResponseEntity<String> registerUser(@RequestBody User user, @RequestParam(required = false) String role) {
        String userRole = (role != null && role.equals("admin")) ? "ROLE_ADMIN" : "ROLE_USER";
        User registeredUser = userService.registerUser(user.getUsername(), user.getEmail(), user.getPassword(), userRole);
        return ResponseEntity.ok("User registered successfully: " + registeredUser.getUsername());
    }
}
