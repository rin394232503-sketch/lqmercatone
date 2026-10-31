import { IsString, IsInt, IsBoolean, IsOptional, IsArray, IsEnum, Min } from 'class-validator';


export class CreateProductDto {
  @IsString()
  nameIt: string;  // 意大利语名称（必填）

  @IsString()
  @IsOptional()
  nameZh?: string;  // 中文名称

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  category: string;

  @IsInt()
  @Min(0)
  priceCent: number;  // 价格（欧分）€9.99 = 999

  @IsInt()
  @IsOptional()
  @Min(0)
  oldPriceCent?: number;  // 原价（欧分）

  @IsInt()
  @Min(0)
  stock: number;

  @IsArray()
  @IsOptional()
  images?: string[];  // 图片 URLs

  @IsString()
  @IsOptional()
  description?: string;  // 意大利语描述

  @IsString()
  @IsOptional()
  descriptionZh?: string;  // 中文描述

  @IsArray()
  @IsOptional()
  tags?: string[];  // hot, new, sale

  @IsBoolean()
  @IsOptional()
  onSale?: boolean;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsArray()
  @IsOptional()
  sizes?: string[];  // S, M, L, XL

  @IsArray()
  @IsOptional()
  colors?: string[];  // Nero, Bianco, Blu...

  @IsInt()
  @IsOptional()
  weight?: number;  // 重量（克）

  @IsBoolean()
  @IsOptional()
  isLarge?: boolean;  // 是否大件商品
}
