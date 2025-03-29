const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const logger = require('./logger');
require('dotenv').config({ path: '../.env' });

const bookService = require('./service/bookService');

const PROTO_PATH = './proto/book.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const bookProto = grpc.loadPackageDefinition(packageDefinition).book;

const server = new grpc.Server();
server.addService(bookProto.BookService.service, bookService);

const port = process.env.PORT || 50051;
server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), () => {
  logger.info(`gRPC Book Service started on port ${port}`);
  server.start();
});