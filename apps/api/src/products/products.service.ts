import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取商品列表（支持分页、筛选、搜索）
   */
  async findAll(query: {
    page?: number;
    limit?: number;
    category?: string;
    onSale?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // 构建筛选条件
    const where: any = {};

    if (query.category) {
      where.category = query.category;
    }

    if (query.onSale !== undefined) {
      where.onSale = query.onSale;
    }

    if (query.search) {
      where.OR = [
        { nameIt: { contains: query.search, mode: 'insensitive' } },
        { nameZh: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // 排序
    const orderBy: any = {};
    if (query.sortBy === 'price') {
      orderBy.priceCent = query.sortOrder || 'asc';
    } else if (query.sortBy === 'createdAt') {
      orderBy.createdAt = query.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc'; // 默认最新
    }

    // 查询数据和总数
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          reviews: {
            select: { rating: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // 计算平均评分
    const productsWithRating = products.map(product => {
      const ratings = product.reviews.map(r => r.rating);
      const avgRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

      return {
        ...product,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount: ratings.length,
        reviews: undefined, // 不在列表中返回完整评价
      };
    });

    return {
      data: productsWithRating,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取单个商品详情
   */
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        reviews: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`商品 ${id} 不存在`);
    }

    // 计算平均评分
    const ratings = product.reviews.map(r => r.rating);
    const avgRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    return {
      ...product,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: ratings.length,
    };
  }

  /**
   * 创建商品（管理员）
   */
  async create(data: any) {
    return this.prisma.product.create({ data });
  }

  /**
   * 更新商品（管理员）
   */
  async update(id: string, data: any) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`商品 ${id} 不存在`);
    }

    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  /**
   * 删除商品（管理员）
   */
  async remove(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`商品 ${id} 不存在`);
    }

    return this.prisma.product.delete({ where: { id } });
  }

  /**
   * 更新库存
   */
  async updateStock(id: string, quantity: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`商品 ${id} 不存在`);
    }

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      throw new Error('库存不足');
    }

    return this.prisma.product.update({
      where: { id },
      data: { stock: newStock },
    });
  }

  /**
   * 获取所有分类
   */
  async getCategories() {
    const categories = [
      'CASA',           // 家居
      'ELETTRONICA',    // 电器
      'ABBIGLIAMENTO',  // 服装
      'COSMETICA',      // 化妆品
      'DECORAZIONI',    // 装饰
      'SPORT',          // 运动
      'GIOCHI',         // 玩具
      'CANCHELLERIA',   // 文具
    ];
    return { categories };
  }
}
