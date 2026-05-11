import { IsEmail, IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 80)
  fullName!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}
