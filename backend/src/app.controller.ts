import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      message: 'Mini Job Queue API is running',
      status: 'online',
      endpoints: ['GET /jobs', 'POST /jobs', 'PATCH /jobs/:id/status', 'DELETE /jobs/:id'],
    };
  }
}
