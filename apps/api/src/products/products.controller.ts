import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductCategory } from '@prisma/client';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * GET /api/v1/products
   * 获取商品列表（支持分页、筛选、搜索）
   * 查询参数：
   * - page: 页码（默认 1）
   * - limit: 每页数量（默认 20）
   * - category: 分类（ABBIGLIAMENTO, CASA, ELETTRONICA 等）
   * - onSale: 是否在售（true/false）
   * - search: 搜索关键词
   * - sortBy: 排序字段（price, createdAt）
   * - sortOrder: 排序方向（asc, desc）
   */
  @Get()
  async findAll(
    @Query('page', ParseIntPipe) page?: number,
    @Query('limit', ParseIntPipe) limit?: number,
    @Query('category') category?: ProductCategory,
    @Query('onSale') onSale?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.productsService.findAll({
      page,
      limit,
      category,
      onSale: onSale === 'true',
      search,
      sortBy,
      sortOrder,
    });
  }

  /**
   * GET /api/v1/products/categories
   * 获取所有商品分类
   */
  @Get('categories')
  async getCategories() {
    return this.productsService.getCategories();
  }

  /**
   * GET /api/v1/products/:id
   * 获取单个商品详情
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  /**
   * POST /api/v1/products
   * 创建商品（需要管理员权限）
   */
  @Post()
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  /**
   * PUT /api/v1/products/:id
   * 更新商品（需要管理员权限）
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  /**
   * DELETE /api/v1/products/:id
   * 删除商品（需要管理员权限）
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
