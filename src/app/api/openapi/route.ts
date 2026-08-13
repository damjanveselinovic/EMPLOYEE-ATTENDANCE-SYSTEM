import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  console.log("HIT app/api/openapi GET");
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Evidencija zaposlenih API",
      version: "1.0.0",
      description: "OpenAPI dokumentacija za Next.js App Router backend.",
    },
    servers: [
      { url: "http://localhost:3000" },
      { url: "http://localhost:3001" },
    ],
    components: {
      securitySchemes: {
        CookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "auth_token",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: { error: { type: "string" } },
          required: ["error"],
        },

        User: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            firstName: { type: "string", example: "Damjan" },
            lastName: { type: "string", example: "Veselinovic" },
            email: { type: "string", example: "damjan@demo.com" },
            role: { type: "string", enum: ["ADMIN", "MANAGER", "EMPLOYEE"] },
            createdAt: { type: "string", format: "date-time" },
            lastLoginAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
          },
          required: ["id", "email", "role"],
        },

        UserUpdateRequest: {
          type: "object",
          description:
            "Fields depend on your implementation. Add/remove properties to match your backend.",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            role: { type: "string", enum: ["ADMIN", "MANAGER", "EMPLOYEE"] },
            password: {
              type: "string",
              description: "Only if you support password change.",
            },
          },
        },

        Activity: {
          type: "object",
          properties: {
            id: { type: "integer", example: 10 },
            name: { type: "string", example: "Work" },
            description: {
              type: "string",
              nullable: true,
              example: "Daily tasks",
            },
            date: { type: "string", example: "2026-02-14" },
            startTime: { type: "string", format: "date-time", nullable: true },
            endTime: { type: "string", format: "date-time", nullable: true },
            userId: { type: "integer", example: 1 },
            type: { type: "string", nullable: true, example: "WORK" },
            user: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "integer" },
                email: { type: "string" },
                firstName: { type: "string", nullable: true },
                lastName: { type: "string", nullable: true },
              },
            },
          },
          required: ["id", "name", "date"],
        },

        ActivityCreateRequest: {
          type: "object",
          required: ["name", "date", "startTime", "endTime"],
          properties: {
            name: { type: "string", example: "Meeting" },
            description: {
              type: "string",
              nullable: true,
              example: "Sprint planning",
            },
            date: { type: "string", example: "2026-02-14" },
            startTime: { type: "string", example: "09:00" },
            endTime: { type: "string", example: "10:00" },
            targetUserId: {
              type: "integer",
              nullable: true,
              example: 2,
              description:
                "If ADMIN/MANAGER can assign activity to another user.",
            },
            typeId: {
              type: "integer",
              nullable: true,
              example: 1,
              description: "Only if your backend allows setting type.",
            },
          },
        },

        ActivityUpdateRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string", nullable: true },
            date: { type: "string" },
            startTime: { type: "string", example: "09:00" },
            endTime: { type: "string", example: "10:00" },
            targetUserId: { type: "integer", nullable: true },
            typeId: { type: "integer", nullable: true },
          },
        },

        AttendanceItem: {
          type: "object",
          properties: {
            id: { type: "integer", example: 100 },
            date: { type: "string", example: "2026-02-14" },
            status: { type: "string", enum: ["PRESENT", "LATE", "ABSENT"] },
            startTime: { type: "string", format: "date-time", nullable: true },
            endTime: { type: "string", format: "date-time", nullable: true },
            userId: { type: "integer", example: 1 },
          },
          required: ["id", "date", "status"],
        },

        AttendanceCheckRequest: {
          type: "object",
          required: ["date"],
          properties: {
            date: {
              type: "string",
              example: "2026-02-14",
              description:
                "Date (YYYY-MM-DD) for which you are checking in/out.",
            },
          },
        },
      },
    },
    security: [{ CookieAuth: [] }],
    paths: {
      "/api/auth/login": {
        post: {
          summary: "Login",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", example: "admin@demo.com" },
                    password: { type: "string", example: "Admin123!" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "OK" },
            "400": {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/auth/register": {
        post: {
          summary: "Register",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["firstName", "lastName", "email", "password"],
                  properties: {
                    firstName: { type: "string", example: "Damjan" },
                    lastName: { type: "string", example: "Veselinovic" },
                    email: { type: "string", example: "damjan@demo.com" },
                    password: { type: "string", example: "Damjan123!" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "409": {
              description: "Conflict (email already exists)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          summary: "Logout",
          description:
            "Clears httpOnly auth cookie (auth_token) and ends the session.",
          responses: {
            "200": { description: "Logged out" },
            "401": {
              description: "Unauthorized (not logged in)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/auth/me": {
        get: {
          summary: "Current user (iz cookie JWT)",
          responses: {
            "200": { description: "OK" },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/users": {
        get: {
          summary: "List users (ADMIN/MANAGER)",
          description:
            "Returns users list for dropdown/administration. Intended for ADMIN/MANAGER roles.",
          responses: {
            "200": {
              description: "Users list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      users: {
                        type: "array",
                        items: { $ref: "#/components/schemas/User" },
                      },
                    },
                    required: ["users"],
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden (role not allowed)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/users/{id}": {
        get: {
          summary: "Get user by id (ADMIN/MANAGER)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": {
              description: "User",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/User" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },

        put: {
          summary: "Update user (ADMIN)",
          description:
            "Updates user fields (e.g., name, email, role). Exact fields depend on backend implementation.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserUpdateRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/User" },
                },
              },
            },
            "400": {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },

        delete: {
          summary: "Delete user (ADMIN)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            "204": { description: "Deleted" },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/activities": {
        get: {
          summary: "List activities",
          description:
            "Returns activities in a date range. EMPLOYEE typically sees only own activities; MANAGER/ADMIN may see all or filtered.",
          parameters: [
            {
              name: "from",
              in: "query",
              required: true,
              schema: { type: "string", example: "2026-02-10" },
              description: "Start date (YYYY-MM-DD)",
            },
            {
              name: "to",
              in: "query",
              required: true,
              schema: { type: "string", example: "2026-02-14" },
              description:
                "End date (YYYY-MM-DD), inclusive/exclusive depends on backend.",
            },
            {
              name: "userId",
              in: "query",
              required: false,
              schema: { type: "integer", example: 1 },
              description:
                "Optional filter by user (usually ADMIN/MANAGER only).",
            },
          ],
          responses: {
            "200": {
              description: "Activities list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Activity" },
                      },
                    },
                    required: ["items"],
                  },
                },
              },
            },
            "400": {
              description: "Bad Request (invalid dates/params)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },

        post: {
          summary: "Create activity (ADMIN/MANAGER)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActivityCreateRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Activity" },
                },
              },
            },
            "400": {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/api/activities/{id}": {
        put: {
          summary: "Update activity (ADMIN/MANAGER)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActivityUpdateRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Activity" },
                },
              },
            },
            "400": {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },

        delete: {
          summary: "Delete activity (ADMIN/MANAGER)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            "204": { description: "Deleted" },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/api/activities/ics": {
        get: {
          summary: "Export activities as ICS",
          description:
            "Returns calendar file (.ics) for activities in a date range. Exact params depend on your implementation.",
          parameters: [
            {
              name: "from",
              in: "query",
              required: true,
              schema: { type: "string", example: "2026-02-10" },
            },
            {
              name: "to",
              in: "query",
              required: true,
              schema: { type: "string", example: "2026-02-14" },
            },
            {
              name: "userId",
              in: "query",
              required: false,
              schema: { type: "integer", example: 1 },
            },
          ],
          responses: {
            "200": {
              description: "ICS file",
              content: {
                "text/calendar": {
                  schema: { type: "string", format: "binary" },
                },
              },
              headers: {
                "Content-Disposition": {
                  schema: { type: "string" },
                  description:
                    'Attachment filename, e.g. attachment; filename="activities.ics"',
                },
              },
            },
            "400": {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/attendance": {
        get: {
          summary: "Attendance history",
          description:
            "Returns attendance records. EMPLOYEE usually only sees own records; ADMIN/MANAGER may query for a specific userId.",
          parameters: [
            {
              name: "from",
              in: "query",
              required: false,
              schema: { type: "string", example: "2026-01-15" },
              description: "Optional start date (YYYY-MM-DD)",
            },
            {
              name: "to",
              in: "query",
              required: false,
              schema: { type: "string", example: "2026-02-14" },
              description: "Optional end date (YYYY-MM-DD)",
            },
            {
              name: "userId",
              in: "query",
              required: false,
              schema: { type: "integer", example: 1 },
              description: "Optional user filter (usually ADMIN/MANAGER).",
            },
          ],
          responses: {
            "200": {
              description: "Attendance list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: { $ref: "#/components/schemas/AttendanceItem" },
                      },
                    },
                    required: ["items"],
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/api/attendance/check-in": {
        post: {
          summary: "Check-in",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AttendanceCheckRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Check-in saved/updated" },
            "400": {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/api/attendance/check-out": {
        post: {
          summary: "Check-out",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AttendanceCheckRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Check-out saved/updated" },
            "400": {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "Forbidden",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec);
}
