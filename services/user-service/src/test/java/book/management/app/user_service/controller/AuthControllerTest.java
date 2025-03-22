package book.management.app.user_service.controller;

import book.management.app.user_service.config.JwtUtils;
import book.management.app.user_service.entity.User;
import book.management.app.user_service.service.UserService;
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

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)  // Use MockitoExtension for JUnit 5
public class AuthControllerTest {

    @Mock
    private UserService userService;

    @Mock
    private JwtUtils jwtUtils;  // Mock JwtUtils if used in the controller

    @InjectMocks
    private AuthController authController;  // Inject mocks into the controller

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    public void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(authController).build();
        objectMapper = new ObjectMapper();
    }

    @Test
    public void testRegisterUserSuccess() throws Exception {
        // Arrange
        User user = new User();
        user.setUsername("newuser");
        user.setEmail("newuser@example.com");
        user.setPassword("password123");

        when(userService.registerUser(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(user);

        // Act & Assert
        mockMvc.perform(post("/users/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(user)))
                .andExpect(status().isOk())
                .andExpect(content().string("User registered successfully: newuser"));
    }

    @Test
    public void testRegisterAdminUser() throws Exception {
        // Arrange
        User user = new User();
        user.setUsername("adminuser");
        user.setEmail("admin@example.com");
        user.setPassword("admin123");

        when(userService.registerUser(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(user);

        // Act & Assert
        mockMvc.perform(post("/users/register?role=admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(user)))
                .andExpect(status().isOk())
                .andExpect(content().string("User registered successfully: adminuser"));
    }
}