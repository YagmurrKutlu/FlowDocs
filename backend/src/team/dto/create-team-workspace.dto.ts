import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateTeamWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  name!: string;
}
