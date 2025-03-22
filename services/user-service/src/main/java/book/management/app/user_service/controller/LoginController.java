package book.management.app.user_service.controller;

import book.management.app.user_service.entity.User;
import book.management.app.user_service.service.LoginService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
@Tag(name = "Login", description = "Endpoints for user login")
public class LoginController {

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
            return ResponseEntity.ok("Bearer " + token);
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Invalid credentials.");
        }
    }
}
