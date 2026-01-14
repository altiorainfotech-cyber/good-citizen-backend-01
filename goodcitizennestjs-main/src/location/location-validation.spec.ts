import { UpdateLocationDto } from './dto/update-location.dto';
import { validate } from 'class-validator';

describe('Location Validation', () => {
  describe('UpdateLocationDto', () => {
    it('should validate correct location data', async () => {
      const dto = new UpdateLocationDto();
      dto.longitude = -122.4194;
      dto.latitude = 37.7749;
      dto.accuracy = 10;
      dto.source = 'gps';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid longitude', async () => {
      const dto = new UpdateLocationDto();
      dto.longitude = 181; // Invalid longitude
      dto.latitude = 37.7749;
      dto.accuracy = 10;
      dto.source = 'gps';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('max');
    });

    it('should reject invalid latitude', async () => {
      const dto = new UpdateLocationDto();
      dto.longitude = -122.4194;
      dto.latitude = 91; // Invalid latitude
      dto.accuracy = 10;
      dto.source = 'gps';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('max');
    });

    it('should reject invalid source', async () => {
      const dto = new UpdateLocationDto();
      dto.longitude = -122.4194;
      dto.latitude = 37.7749;
      dto.accuracy = 10;
      dto.source = 'invalid' as any; // Invalid source

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('isEnum');
    });

    it('should reject negative accuracy', async () => {
      const dto = new UpdateLocationDto();
      dto.longitude = -122.4194;
      dto.latitude = 37.7749;
      dto.accuracy = -5; // Invalid accuracy
      dto.source = 'gps';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints).toHaveProperty('min');
    });
  });
});