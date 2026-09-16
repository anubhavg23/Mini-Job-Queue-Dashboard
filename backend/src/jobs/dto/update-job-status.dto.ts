import { IsIn, IsNotEmpty } from 'class-validator';
import { JobStatus, JOB_STATUSES } from '../job.entity';

export class UpdateJobStatusDto {
  @IsNotEmpty({ message: 'status is required' })
  @IsIn(JOB_STATUSES, {
    message: `status must be one of: ${JOB_STATUSES.join(', ')}`,
  })
  status: JobStatus;
}
