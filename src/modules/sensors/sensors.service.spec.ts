import { ConfigService } from '@nestjs/config';
import { SensorsService } from './sensors.service';

describe('SensorsService status', () => {
  const findOneAndUpdate = jest.fn();
  let service: SensorsService;

  beforeEach(() => {
    jest.clearAllMocks();
    findOneAndUpdate.mockResolvedValue({ sensor_id: 'sensor-1', active: false });
    service = new SensorsService(
      {} as never,
      { findOneAndUpdate } as never,
      { get: jest.fn() } as unknown as ConfigService,
    );
  });

  it('upserts the requested active state by sensor identifier', async () => {
    await expect(service.setSensorStatus('sensor-1', false)).resolves.toEqual({
      sensor_id: 'sensor-1',
      active: false,
    });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { sensor_id: 'sensor-1' },
      { $set: { active: false, updated_at: expect.any(Date) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  });
});