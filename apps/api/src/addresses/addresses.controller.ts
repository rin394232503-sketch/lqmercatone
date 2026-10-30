import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';

@Controller('addresses')
@UseGuards(AuthGuard('jwt'))
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  /**
   * GET /api/v1/addresses
   * 获取用户所有地址
   */
  @Get()
  async getUserAddresses(@Req() req: ExpressRequest & { user: any }) {
    return this.addressesService.getUserAddresses(req.user.id);
  }

  /**
   * GET /api/v1/addresses/default
   * 获取默认地址
   */
  @Get('default')
  async getDefaultAddress(@Req() req: ExpressRequest & { user: any }) {
    return this.addressesService.getDefaultAddress(req.user.id);
  }

  /**
   * POST /api/v1/addresses
   * 添加新地址
   */
  @Post()
  async createAddress(
    @Req() req: ExpressRequest & { user: any },
    @Body() body: {
      name: string;
      phone: string;
      detail: string;
      city?: string;
      postcode?: string;
      region?: string;
      isDefault?: boolean;
    },
  ) {
    return this.addressesService.createAddress(req.user.id, body);
  }

  /**
   * PUT /api/v1/addresses/:id
   * 更新地址
   */
  @Put(':id')
  async updateAddress(
    @Req() req: ExpressRequest & { user: any },
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      phone?: string;
      detail?: string;
      city?: string;
      postcode?: string;
      region?: string;
      isDefault?: boolean;
    },
  ) {
    return this.addressesService.updateAddress(req.user.id, id, body);
  }

  /**
   * DELETE /api/v1/addresses/:id
   * 删除地址
   */
  @Delete(':id')
  async deleteAddress(@Req() req: ExpressRequest & { user: any }, @Param('id') id: string) {
    return this.addressesService.deleteAddress(req.user.id, id);
  }
}
