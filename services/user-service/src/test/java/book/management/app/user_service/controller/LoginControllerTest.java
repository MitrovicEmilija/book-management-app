package book.management.app.user_service.controller;

import book.management.app.user_service.config.JwtUtils;
import book.management.app.user_service.entity.User;
import book.management.app.user_service.service.LoginService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)  // Use MockitoExtension for JUnit 5
public class LoginControllerTest {

    @Mock
    private LoginService loginService;

    @Mock
    private JwtUtils jwtUtils;

    @InjectMocks
    private LoginController loginController;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    public void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(loginController).build();
        objectMapper = new ObjectMapper();
    }

    @Test
    public void testLoginUserSuccess() throws Exception {
        // Arrange
        User user = new User();
        user.setUsername("testuser");
        user.setPassword("password123");

        when(loginService.loginUser("testuser", "password123"))
                .thenReturn("mocked-jwt-token");

        // Act & Assert
        mockMvc.perform(post("/users/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(user)))
                .andExpect(status().isOk())
                .andExpect(content().string("mocked-jwt-token")); // Updated to expect raw token
    }

    @Test
    public void testLoginUserInvalidCredentials() throws Exception {
        // Arrange
        User user = new User();
        user.setUsername("testuser");
        user.setPassword("wrongpassword");

        when(loginService.loginUser("testuser", "wrongpassword"))
                .thenThrow(new RuntimeException("Invalid credentials"));

        // Act & Assert
        mockMvc.perform(post("/users/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(user)))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string("Invalid credentials."));
    }
}