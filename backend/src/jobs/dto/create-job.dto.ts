import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  @Matches(/\S/, { message: 'title cannot be empty or whitespace only' })
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'type is required' })
  @Matches(/\S/, { message: 'type cannot be empty or whitespace only' })
  @MaxLength(100)
  type: string;
}
