# Sign Language Education Backend API

This is the backend API for the Sign Language Education mobile application designed for deaf and mute students in Maharashtra.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **User Management**: Support for students, teachers, and parents
- **Class Management**: Teachers can create classes and manage students
- **Media Upload**: Local file storage for videos and images with progress tracking
- **Assignment System**: Create, submit, and grade assignments
- **Practice Tracking**: Writing and typing practice with analytics
- **Reports & Analytics**: Comprehensive progress tracking and reporting

## Technology Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- Multer for file uploads
- bcryptjs for password hashing

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password

### Classes
- `POST /api/classes` - Create new class (teacher only)
- `GET /api/classes/teacher` - Get teacher's classes
- `GET /api/classes/student` - Get student's classes
- `POST /api/classes/join` - Join class by code (student only)
- `GET /api/classes/:classId` - Get class details
- `PUT /api/classes/:classId` - Update class (teacher only)
- `DELETE /api/classes/:classId` - Delete class (teacher only)

### Media
- `POST /api/media/upload/video` - Upload video (teacher only)
- `POST /api/media/upload/image` - Upload image (teacher only)
- `GET /api/media/class/:classId` - Get class media
- `POST /api/media/:mediaId/view` - Record media view (student only)
- `GET /api/media/:mediaId` - Get media details

### Assignments
- `POST /api/assignments` - Create assignment (teacher only)
- `GET /api/assignments/class/:classId` - Get class assignments
- `GET /api/assignments/:assignmentId` - Get assignment details
- `POST /api/assignments/:assignmentId/submit` - Submit assignment (student only)
- `PUT /api/assignments/:assignmentId/grade/:studentId` - Grade assignment (teacher only)

### Practice
- `POST /api/practice` - Save practice session (student only)
- `GET /api/practice/history` - Get practice history (student only)
- `GET /api/practice/stats` - Get practice statistics (student only)
- `GET /api/practice/analytics/:studentId/:classId` - Get student analytics (teacher only)

### Reports
- `GET /api/reports/student/:studentId` - Get student progress report
- `GET /api/reports/class/:classId` - Get class analytics (teacher only)
- `GET /api/reports/parent/dashboard` - Get parent dashboard

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `env.example`:
```bash
cp env.example .env
```

3. Update the `.env` file with your configuration:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sign_language_education
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d
NODE_ENV=development
```

4. Start MongoDB service

5. Run the server:
```bash
# Development
npm run dev

# Production
npm start
```

## File Storage

The application stores uploaded files locally in the `uploads/` directory:
- `uploads/videos/` - Video files
- `uploads/images/` - Image files
- `uploads/documents/` - Document files
- `uploads/thumbnails/` - Thumbnail images

## Database Models

### User
- Basic user information with role-based fields
- Password hashing with bcryptjs
- Role-specific information (student, teacher, parent)

### Class
- Class management with unique class codes
- Student enrollment
- Teacher assignment

### Media
- File storage information
- View tracking and analytics
- Category and tag support

### Assignment
- Question-based assignments
- Submission tracking
- Grading system

### Practice
- Practice session tracking
- Performance analytics
- Multiple practice types (writing, typing, drawing)

## Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Role-based access control
- Input validation with express-validator
- File upload restrictions
- Rate limiting
- CORS protection
- Helmet security headers

## Error Handling

- Comprehensive error handling middleware
- Validation error responses
- File cleanup on errors
- Graceful error responses

## Development

The server runs on port 5000 by default and provides comprehensive logging for development. All API endpoints return JSON responses with appropriate HTTP status codes.
