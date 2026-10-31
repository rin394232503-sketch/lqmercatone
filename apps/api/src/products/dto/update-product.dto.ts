import { IsString, IsInt, IsBoolean, IsOptional, IsArray, IsEnum, Min } from 'class-validator';

import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  // 所有字段都是可选的（继承自 PartialType）
}
