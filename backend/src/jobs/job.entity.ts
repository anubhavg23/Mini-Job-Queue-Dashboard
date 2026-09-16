import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export const JOB_STATUSES: JobStatus[] = ['pending', 'running', 'completed', 'failed'];

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: JobStatus;

  @CreateDateColumn()
  createdAt: Date;
}
