import logging
import os
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import grpc
import httpx
from grpc import RpcError
import book_pb2
import book_pb2_grpc
from base64 import b64decode
import jwt
from typing import Optional
import uvicorn
from google.protobuf.json_format import MessageToDict

app = FastAPI(title="Mobile API Gateway")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("mobile-gateway.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Service URLs
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user-service-ita:8080")
TRANSACTION_SERVICE_URL = os.getenv("TRANSACTION_SERVICE_URL", "http://transaction-service-ita:6000")
BOOK_SERVICE_URL = os.getenv("BOOK_SERVICE_URL", "book-service-ita:50051")
JWT_SECRET_ENCODED = os.getenv("JWT_SECRET", "GD01pc7/7BmRWmWtY71dIUjR1G+we3N5d9EKYWmzuFI6o6eRCsetl/9KruFclnFwmb7B9I62hhDfjUAl3IUDUw==")
JWT_SECRET = b64decode(JWT_SECRET_ENCODED)

# gRPC client for book-service
book_channel = grpc.insecure_channel(BOOK_SERVICE_URL)
book_client = book_pb2_grpc.BookServiceStub(book_channel)

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[str] = None

class BookRequest(BaseModel):
    title: str
    author: str
    isbn: Optional[str] = None
    userId: str

class TransactionRequest(BaseModel):
    userId: int
    bookId: int
    transactionType: str

# Middleware for JWT validation
async def authenticate_jwt(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        logger.warning("Missing Authorization header")
        raise HTTPException(status_code=401, detail="Authorization header required")

    try:
        token = auth_header.split(" ")[1]
        logger.debug(f"Validating token: {token[:10]}...")
        decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS512"])
        logger.info(f"Token validated successfully for user: {decoded.get('sub')}")
        return decoded
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid JWT token: {str(e)}")
        raise HTTPException(status_code=403, detail="Invalid token")
    except Exception as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise HTTPException(status_code=403, detail="Invalid token")

# User login
@app.post("/api/mobile/users/login")
async def login(request: LoginRequest):
    logger.info(f"User login attempt: {request.username}")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{USER_SERVICE_URL}/users/login",
                json={"username": request.username, "password": request.password}
            )
            response.raise_for_status()
            logger.debug(f"User service response: {response.text}")
            token = response.text
            return {"token": token}
        except httpx.HTTPStatusError as e:
            logger.error(f"Login failed for {request.username}: status={e.response.status_code}, response={e.response.text}")
            detail = e.response.text if e.response.text else "Unknown error from user service"
            raise HTTPException(status_code=e.response.status_code, detail=detail)
        except Exception as e:
            logger.error(f"Server error during login for {request.username}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# User registration
@app.post("/api/mobile/users/register")
async def register(request: RegisterRequest):
    logger.info(f"User registration attempt: {request.username}")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{USER_SERVICE_URL}/users/register",
                json={"username": request.username, "email": request.email, "password": request.password},
                params={"role": request.role} if request.role else {}
            )
            response.raise_for_status()
            logger.debug(f"User service response: {response.text}")
            return {"message": response.text}
        except httpx.HTTPStatusError as e:
            logger.error(f"Registration failed for {request.username}: status={e.response.status_code}, response={e.response.text}")
            detail = e.response.text if e.response.text else "Unknown error from user service"
            raise HTTPException(status_code=e.response.status_code, detail=detail)
        except Exception as e:
            logger.error(f"Server error during registration for {request.username}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# Get all books (unprotected)
@app.get("/api/mobile/books")
async def get_all_books():
    logger.info("Fetching all books")
    try:
        response = book_client.GetAllBooks(book_pb2.Empty())
        # Convert protobuf books to list of dictionaries
        books = [MessageToDict(book, preserving_proto_field_name=True) for book in response.books]
        return books
    except RpcError as e:
        logger.error(f"Error fetching books: {str(e)}")
        status_code = 500
        if e.code() == grpc.StatusCode.NOT_FOUND:
            status_code = 404
        raise HTTPException(status_code=status_code, detail=f"Error: {str(e)}")

# Get book by ID (unprotected)
@app.get("/api/mobile/books/{book_id}")
async def get_book(book_id: int):
    logger.info(f"Fetching book with ID: {book_id}")
    try:
        response = book_client.GetBook(book_pb2.BookRequest(id=book_id))
        # Convert single book to dictionary
        return MessageToDict(response, preserving_proto_field_name=True)
    except RpcError as e:
        logger.error(f"Error fetching book {book_id}: {str(e)}")
        status_code = 404 if e.code() == grpc.StatusCode.NOT_FOUND else 500
        raise HTTPException(status_code=status_code, detail=f"Error: {str(e)}")

# Get books by user (protected)
@app.get("/api/mobile/users/{user_id}/books")
async def get_books_by_user(user_id: str, request: Request):
    await authenticate_jwt(request)
    logger.info(f"Fetching books for user: {user_id}")
    try:
        response = book_client.GetBooksByUser(book_pb2.UserRequest(userId=user_id))
        # Convert protobuf books to list of dictionaries
        books = [MessageToDict(book, preserving_proto_field_name=True) for book in response.books]
        return books
    except RpcError as e:
        logger.error(f"Error fetching books for user {user_id}: {str(e)}")
        status_code = 404 if e.code() == grpc.StatusCode.NOT_FOUND else 500
        raise HTTPException(status_code=status_code, detail=f"Error: {str(e)}")

# Create book (protected)
@app.post("/api/mobile/books")
async def create_book(request: BookRequest, auth_request: Request):
    await authenticate_jwt(auth_request)
    logger.info(f"Creating book: {request.title} for user: {request.userId}")
    if not request.title or not request.author or not request.userId:
        logger.warning("Missing required fields for creating book")
        raise HTTPException(status_code=400, detail="Title, author, and userId are required")
    try:
        response = book_client.CreateBook(
            book_pb2.Book(title=request.title, author=request.author, isbn=request.isbn or "", userId=request.userId)
        )
        return MessageToDict(response, preserving_proto_field_name=True)
    except RpcError as e:
        logger.error(f"Error creating book: {str(e)}")
        status_code = 400 if e.code() == grpc.StatusCode.INVALID_ARGUMENT else 500
        raise HTTPException(status_code=status_code, detail=f"Error: {str(e)}")

# Update book (protected)
@app.put("/api/mobile/books/{book_id}")
async def update_book(book_id: int, request: BookRequest, auth_request: Request):
    await authenticate_jwt(auth_request)
    logger.info(f"Updating book with ID: {book_id}")
    if not request.title or not request.author or not request.userId:
        logger.warning("Missing required fields for updating book")
        raise HTTPException(status_code=400, detail="Title, author, and userId are required")
    try:
        response = book_client.UpdateBook(
            book_pb2.Book(id=book_id, title=request.title, author=request.author, isbn=request.isbn or "", userId=request.userId)
        )
        return {"message": response.message}
    except RpcError as e:
        logger.error(f"Error updating book {book_id}: {str(e)}")
        status_code = 404 if e.code() == grpc.StatusCode.NOT_FOUND else 500
        raise HTTPException(status_code=status_code, detail=f"Error: {str(e)}")

# Delete book (protected)
@app.delete("/api/mobile/books/{book_id}")
async def delete_book(book_id: int, request: Request):
    await authenticate_jwt(request)
    logger.info(f"Deleting book with ID: {book_id}")
    try:
        response = book_client.DeleteBook(book_pb2.BookRequest(id=book_id))
        return {"message": response.message}
    except RpcError as e:
        logger.error(f"Error deleting book {book_id}: {str(e)}")
        status_code = 404 if e.code() == grpc.StatusCode.NOT_FOUND else 500
        raise HTTPException(status_code=status_code, detail=f"Error: {str(e)}")

# Get transactions (unprotected)
@app.get("/api/mobile/transactions")
async def get_transactions(page: int = 1, limit: int = 10):
    logger.info(f"Fetching transactions: page={page}, limit={limit}")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{TRANSACTION_SERVICE_URL}/transactions",
                params={"page": page, "limit": limit}
            )
            response.raise_for_status()
            #send_book_purchase_event(str(request.userId), request.bookId, request.transactionType)
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Error fetching transactions: status={e.response.status_code}, response={e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text or "Unknown error")
        except Exception as e:
            logger.error(f"Server error while fetching transactions: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# Create transaction (protected)
@app.post("/api/mobile/transactions")
async def create_transaction(request: TransactionRequest, auth_request: Request):
    await authenticate_jwt(auth_request)
    logger.info(f"Creating transaction: userId={request.userId}, bookId={request.bookId}, transactionType={request.transactionType}")
    if not request.userId or not request.bookId or not request.transactionType:
        logger.warning("Missing required fields for creating transaction")
        raise HTTPException(status_code=400, detail="userId, bookId, and transactionType are required")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TRANSACTION_SERVICE_URL}/transactions",
                json={"userId": request.userId, "bookId": request.bookId, "transactionType": request.transactionType}
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"Error creating transaction: status={e.response.status_code}, response={e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text or "Unknown error")
    except Exception as e:
        logger.error(f"Server error while creating transaction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

if __name__ == "__main__":
    logger.info("Starting Mobile API Gateway on port 4000")
    uvicorn.run(app, host="0.0.0.0", port=4000)