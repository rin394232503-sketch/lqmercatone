import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取用户所有地址
   */
  async getUserAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  /**
   * 添加新地址
   */
  async createAddress(userId: string, data: {
    name: string;
    phone: string;
    detail: string;
    city?: string;
    postcode?: string;
    region?: string;
    isDefault?: boolean;
  }) {
    // 如果设为默认地址，取消其他默认
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  /**
   * 更新地址
   */
  async updateAddress(userId: string, addressId: string, data: {
    name?: string;
    phone?: string;
    detail?: string;
    city?: string;
    postcode?: string;
    region?: string;
    isDefault?: boolean;
  }) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('地址不存在');
    }

    // 如果设为默认地址，取消其他默认
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data,
    });
  }

  /**
   * 删除地址
   */
  async deleteAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('地址不存在');
    }

    return this.prisma.address.delete({
      where: { id: addressId },
    });
  }

  /**
   * 获取默认地址
   */
  async getDefaultAddress(userId: string) {
    return this.prisma.address.findFirst({
      where: { userId, isDefault: true },
    });
  }
}
