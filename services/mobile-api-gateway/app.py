import logging
import os
from fastapi import FastAPI, HTTPException, Request
import grpc
from grpc import RpcError
import book_pb2_grpc as book_pb2_grpc
import book_pb2 as book_pb2
import httpx
from logger import setup_logger
from typing import Optional
import jwt
from datetime import datetime

app = FastAPI(title="Mobile API Gateway")

# Configure logging
logger = setup_logger(name="mobile-api-gateway", log_file="mobile-gateway.log")

# Service URLs
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user-service-ita:8080")
TRANSACTION_SERVICE_URL = os.getenv("TRANSACTION_SERVICE_URL", "http://transaction-service-ita:6000")
BOOK_SERVICE_URL = os.getenv("BOOK_SERVICE_URL", "book-service-ita:50051")
JWT_SECRET_ENCODED = os.getenv("JWT_SECRET", "GD01pc7/7BmRWmWtY71dIUjR1G+we3N5d9EKYWmzuFI6o6eRCsetl/9KruFclnFwmb7B9I62hhDfjUAl3IUDUw==")
JWT_SECRET = JWT_SECRET_ENCODED.encode()  # Use raw secret as user-service-ita treats it as raw

# gRPC client for book-service
book_channel = grpc.insecure_channel(BOOK_SERVICE_URL)
book_client = book_pb2_grpc.BookServiceStub(book_channel)

# Middleware for JWT validation
async def authenticate_jwt(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        logger.warning("Missing Authorization header")
        raise HTTPException(status_code=401, detail="Authorization header required")

    try:
        token = auth_header.split(" ")[1]  # Expecting "Bearer <token>"
        logger.debug(f"Validating token: {token}")
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
async def login(username: str, password: str):
    logger.info(f"User login attempt: {username}")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{USER_SERVICE_URL}/users/login",
                json={"username": username, "password": password}
            )
            response.raise_for_status()
            return {"token": response.json()}
        except httpx.HTTPStatusError as e:
            logger.error(f"Login failed for {username}: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except Exception as e:
            logger.error(f"Server error during login for {username}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# User registration
@app.post("/api/mobile/users/register")
async def register(username: str, email: str, password: str, role: Optional[str] = None):
    logger.info(f"User registration attempt: {username}")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{USER_SERVICE_URL}/users/register",
                json={"username": username, "email": email, "password": password},
                params={"role": role} if role else {}
            )
            response.raise_for_status()
            return {"message": response.json()}
        except httpx.HTTPStatusError as e:
            logger.error(f"Registration failed for {username}: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except Exception as e:
            logger.error(f"Server error during registration for {username}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# Get all books (unprotected for simplicity)
@app.get("/api/mobile/books")
async def get_all_books():
    logger.info("Fetching all books")
    try:
        response = await book_client.GetAllBooks(book_pb2.Empty())
        return response.books
    except RpcError as e:
        logger.error(f"Error fetching books: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# Get book by ID (unprotected for simplicity)
@app.get("/api/mobile/books/{book_id}")
async def get_book(book_id: int):
    logger.info(f"Fetching book with ID: {book_id}")
    try:
        response = await book_client.GetBook(book_pb2.BookRequest(id=book_id))
        return response
    except RpcError as e:
        status_code = 404 if e.code() == grpc.StatusCode.NOT_FOUND else 500
        logger.error(f"Error fetching book {book_id}: {str(e)}")
        raise HTTPException(status_code=status_code, detail=f"Error: {str(e)}")

# Get books by user (protected)
@app.get("/api/mobile/users/{user_id}/books")
async def get_books_by_user(user_id: str, request: Request):
    user = await authenticate_jwt(request)
    logger.info(f"Fetching books for user: {user_id}")
    try:
        response = await book_client.GetBooksByUser(book_pb2.UserRequest(userId=user_id))
        return response.books
    except RpcError as e:
        status_code = 404 if e.code() == grpc.StatusCode.NOT_FOUND else 500
        logger.error(f"Error fetching books for user {user_id}: {str(e)}")
        raise HTTPException(status_code=status_code, detail=f"Error: {str(e)}")

# Create book (protected)
@app.post("/api/mobile/books")
async def create_book(title: str, author: str, isbn: Optional[str] = None, userId: str = None, request: Request = None):
    user = await authenticate_jwt(request)
    logger.info(f"Creating book: {title} for user: {userId}")
    if not title or not author or not userId:
        logger.warning("Missing required fields for creating book")
        raise HTTPException(status_code=400, detail="Title, author, and userId are required")

    try:
        response = await book_client.CreateBook(
            book_pb2.Book(title=title, author=author, isbn=isbn or "", userId=userId)
        )
        return response
    except RpcError as e:
        status_code = 400 if e.code() == grpc.StatusCode.INVALID_ARGUMENT else 500
        logger.error(f"Error creating book: {str(e)}")
        raise HTTPException(status_code=status_code, detail=f"Error: {str(e)}")

# Update book (protected)
@app.put("/api/mobile/books/{book_id}")
async def update_book(book_id: int, title: str, author: str, isbn: Optional[str] = None, userId: str = None, request: Request = None):
    user = await authenticate_jwt(request)
    logger.info(f"Updating book with ID: {book_id}")
    if not title or not author or not userId:
        logger.warning("Missing required fields for updating book")
        raise HTTPException(status_code=400, detail="Title, author, and userId are required")

    try:
        response = await book_client.UpdateBook(
            book_pb2.Book(id=book_id, title=title, author=author, isbn=isbn or "", userId=userId, created_at=datetime.now().isoformat())
        )
        return {"message": response.message}
    except RpcError as e:
        status_code = 404 if e.code() == grpc.StatusCode.NOT_FOUND else 500
        logger.error(f"Error updating book {book_id}: {str(e)}")
        raise HTTPException(status_code=status_code, detail=f"Error: {str(e)}")

# Delete book (protected)
@app.delete("/api/mobile/books/{book_id}")
async def delete_book(book_id: int, request: Request):
    user = await authenticate_jwt(request)
    logger.info(f"Deleting book with ID: {book_id}")
    try:
        response = await book_client.DeleteBook(book_pb2.BookRequest(id=book_id))
        return {"message": response.message}
    except RpcError as e:
        status_code = 404 if e.code() == grpc.StatusCode.NOT_FOUND else 500
        logger.error(f"Error deleting book {book_id}: {str(e)}")
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
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Error fetching transactions: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except Exception as e:
            logger.error(f"Server error while fetching transactions: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# Create transaction (unprotected)
@app.post("/api/mobile/transactions")
async def create_transaction(userId: int, bookId: int, transactionType: str):
    logger.info(f"Creating transaction: userId={userId}, bookId={bookId}, transactionType={transactionType}")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{TRANSACTION_SERVICE_URL}/transactions",
                json={"userId": userId, "bookId": bookId, "transactionType": transactionType}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Error creating transaction: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except Exception as e:
            logger.error(f"Server error while creating transaction: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# Get transaction by ID (unprotected)
@app.get("/api/mobile/transactions/{transaction_id}")
async def get_transaction(transaction_id: int):
    logger.info(f"Fetching transaction with ID: {transaction_id}")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{TRANSACTION_SERVICE_URL}/transactions/{transaction_id}")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Error fetching transaction {transaction_id}: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except Exception as e:
            logger.error(f"Server error while fetching transaction {transaction_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# Get transactions by user (unprotected)
@app.get("/api/mobile/transactions/user/{user_id}")
async def get_transactions_by_user(user_id: int):
    logger.info(f"Fetching transactions for user ID: {user_id}")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{TRANSACTION_SERVICE_URL}/transactions/user/{user_id}")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Error fetching transactions for user {user_id}: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except Exception as e:
            logger.error(f"Server error while fetching transactions for user {user_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# Update transaction (unprotected)
@app.put("/api/mobile/transactions/{transaction_id}")
async def update_transaction(transaction_id: int, userId: int, bookId: int, transactionType: str):
    logger.info(f"Updating transaction with ID: {transaction_id}")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(
                f"{TRANSACTION_SERVICE_URL}/transactions/{transaction_id}",
                json={"userId": userId, "bookId": bookId, "transactionType": transactionType}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Error updating transaction {transaction_id}: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except Exception as e:
            logger.error(f"Server error while updating transaction {transaction_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# Delete transaction (unprotected)
@app.delete("/api/mobile/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int):
    logger.info(f"Deleting transaction with ID: {transaction_id}")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(f"{TRANSACTION_SERVICE_URL}/transactions/{transaction_id}")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Error deleting transaction {transaction_id}: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
        except Exception as e:
            logger.error(f"Server error while deleting transaction {transaction_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Mobile API Gateway on port 4000")
    uvicorn.run(app, host="0.0.0.0", port=4000)