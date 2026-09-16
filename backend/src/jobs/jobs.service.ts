import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from './job.entity';
import { CreateJobDto } from './dto/create-job.dto';

// Strict state transition map: specifies allowed previous statuses for each target status
const ALLOWED_PREVIOUS_STATUSES: Record<JobStatus, JobStatus[]> = {
  running: ['pending'],
  completed: ['running'],
  failed: ['running'],
  pending: [], // Cannot transition back to pending once created
};

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
  ) {}

  async create(dto: CreateJobDto): Promise<Job> {
    const job = this.jobRepo.create({
      title: dto.title.trim(),
      type: dto.type.trim(),
      status: 'pending',
    });
    return this.jobRepo.save(job);
  }

  async findAll(status?: JobStatus): Promise<Job[]> {
    const query = this.jobRepo.createQueryBuilder('job').orderBy('job.createdAt', 'DESC');
    if (status) {
      query.where('job.status = :status', { status });
    }
    return query.getMany();
  }

  /**
   * Concurrency-safe atomic status transition.
   * Uses an atomic conditional SQL UPDATE (optimistic concurrency control).
   * Simultaneous requests will serialize at the database level:
   * the first wins (affected=1) and the second fails to match the conditional criteria (affected=0).
   */
  async updateStatus(id: string, newStatus: JobStatus): Promise<Job> {
    const allowedFrom = ALLOWED_PREVIOUS_STATUSES[newStatus];

    if (!allowedFrom || allowedFrom.length === 0) {
      const existing = await this.jobRepo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Job with ID '${id}' not found`);
      }
      throw new ConflictException(`Cannot transition job from '${existing.status}' to '${newStatus}'`);
    }

    // Atomic conditional update: only succeeds if current DB status is in allowedFrom
    const result = await this.jobRepo
      .createQueryBuilder()
      .update(Job)
      .set({ status: newStatus })
      .where('id = :id AND status IN (:...allowedFrom)', { id, allowedFrom })
      .execute();

    if (result.affected === 0) {
      const current = await this.jobRepo.findOne({ where: { id } });
      if (!current) {
        throw new NotFoundException(`Job with ID '${id}' not found`);
      }
      throw new ConflictException(
        `Cannot transition job from '${current.status}' to '${newStatus}' (transition not allowed or updated concurrently)`,
      );
    }

    return this.jobRepo.findOneByOrFail({ id });
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const result = await this.jobRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Job with ID '${id}' not found`);
    }
    return { success: true };
  }
}
