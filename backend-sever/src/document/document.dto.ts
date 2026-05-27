import { IsNotEmpty, IsOptional } from 'class-validator';
import mongoose from 'mongoose';

export class DocumentDto {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  userId: string;

  @IsOptional()
  content?: string;

  @IsOptional()
  collaborators?: Array<string | mongoose.Schema.Types.ObjectId>;
}

export class UpdateDocumentDto {
  @IsOptional()
  title?: string;

  @IsOptional()
  content?: string;

  @IsOptional()
  collaborators?: Array<string | mongoose.Schema.Types.ObjectId>;
}
