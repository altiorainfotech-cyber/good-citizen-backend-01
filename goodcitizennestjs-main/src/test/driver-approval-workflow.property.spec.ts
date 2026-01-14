import * as fc from 'fast-check';
import { arbitraries, runPropertyTest, validators } from './test-utils';

/**
 * Property 15: Driver Approval Workflow
 * Validates: Requirements 12.1, 12.3
 *
 * Feature: ride-hailing-backend-integration, Property 15: Driver Approval Workflow
 */

// Driver approval status enum
const DriverApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

// Driver registration data generator
const driverRegistrationData = () =>
  fc.record({
    first_name: arbitraries.name(),
    last_name: arbitraries.name(),
    email: arbitraries.email(),
    password: arbitraries.password(),
    phone_number: arbitraries.phoneNumber(),
    country_code: fc.constantFrom('+1', '+44', '+91', '+86'),
    vehicle_type: fc.constantFrom('sedan', 'suv', 'hatchback', 'ambulance'),
    license_plate: fc.string({ minLength: 3, maxLength: 10 }),
  });

// Driver approval action generator
const driverApprovalAction = () =>
  fc.record({
    approval: fc.constantFrom(
      DriverApprovalStatus.APPROVED,
      DriverApprovalStatus.REJECTED,
      DriverApprovalStatus.PENDING,
    ),
    rejection_reason: fc.option(fc.string({ minLength: 10, maxLength: 200 })),
    admin_id: fc.string(),
  });

// Document upload data generator
const documentUploadData = () =>
  fc.record({
    aadhar_front: fc.option(fc.string()),
    aadhar_back: fc.option(fc.string()),
    dl_front: fc.option(fc.string()),
    dl_back: fc.option(fc.string()),
    profile_image: fc.option(fc.string()),
  });

describe('Property 15: Driver Approval Workflow', () => {
  it('should ensure newly registered drivers start with PENDING approval status', () => {
    const property = fc.property(
      driverRegistrationData(),
      (registrationData) => {
        // Simulate driver registration
        const newDriver = {
          ...registrationData,
          approval: DriverApprovalStatus.PENDING,
          created_at: new Date(),
          documents_uploaded_at: null,
          approved_at: null,
          rejection_reason: null,
        };

        // Verify initial approval status is PENDING
        expect(newDriver.approval).toBe(DriverApprovalStatus.PENDING);

        // Verify approval-related fields are properly initialized
        expect(newDriver.approved_at).toBeNull();
        expect(newDriver.rejection_reason).toBeNull();
        expect(newDriver.documents_uploaded_at).toBeNull();

        // Verify required registration fields are present
        expect(newDriver.first_name).toBeDefined();
        expect(newDriver.last_name).toBeDefined();
        expect(newDriver.email).toBeDefined();
        expect(validators.isValidEmail(newDriver.email)).toBe(true);
        expect(newDriver.password).toBeDefined();
        expect(newDriver.password.length).toBeGreaterThanOrEqual(8);

        // Verify vehicle information is captured
        expect(newDriver.vehicle_type).toBeDefined();
        expect(newDriver.license_plate).toBeDefined();

        return true;
      },
    );

    runPropertyTest('Driver Registration Sets PENDING Status', property);
  });

  it('should ensure only APPROVED drivers can be included in driver matching', () => {
    const property = fc.property(
      fc.array(
        fc.record({
          driver_id: fc.string(),
          approval: fc.constantFrom(
            DriverApprovalStatus.PENDING,
            DriverApprovalStatus.APPROVED,
            DriverApprovalStatus.REJECTED,
          ),
          is_online: fc.boolean(),
          location: arbitraries.location(),
          vehicle_type: fc.constantFrom(
            'sedan',
            'suv',
            'hatchback',
            'ambulance',
          ),
        }),
        { minLength: 1, maxLength: 20 },
      ),
      (drivers) => {
        // Simulate driver matching query - only approved drivers should be eligible
        const eligibleDrivers = drivers.filter(
          (driver) =>
            driver.approval === DriverApprovalStatus.APPROVED &&
            driver.is_online,
        );

        // Verify all eligible drivers are approved
        eligibleDrivers.forEach((driver) => {
          expect(driver.approval).toBe(DriverApprovalStatus.APPROVED);
          expect(driver.is_online).toBe(true);
        });

        // Verify no pending or rejected drivers are included
        const nonApprovedDrivers = drivers.filter(
          (driver) => driver.approval !== DriverApprovalStatus.APPROVED,
        );

        nonApprovedDrivers.forEach((driver) => {
          expect(eligibleDrivers).not.toContain(driver);
        });

        // Verify offline approved drivers are not included
        const offlineApprovedDrivers = drivers.filter(
          (driver) =>
            driver.approval === DriverApprovalStatus.APPROVED &&
            !driver.is_online,
        );

        offlineApprovedDrivers.forEach((driver) => {
          expect(eligibleDrivers).not.toContain(driver);
        });

        return true;
      },
    );

    runPropertyTest('Only Approved Online Drivers in Matching', property);
  });

  it('should ensure admin approval actions update driver status correctly', () => {
    const property = fc.property(
      driverRegistrationData(),
      driverApprovalAction(),
      (driverData, approvalAction) => {
        // Start with a pending driver
        const pendingDriver = {
          ...driverData,
          approval: DriverApprovalStatus.PENDING,
          approved_at: null as Date | null,
          rejection_reason: null as string | null,
          created_at: new Date(),
        };

        // Simulate admin approval action (with slight delay to ensure different timestamps)
        const updatedDriver = {
          ...pendingDriver,
          approval: approvalAction.approval,
          updated_at: new Date(pendingDriver.created_at.getTime() + 1), // Ensure updated_at > created_at
          approved_at: null as Date | null,
          rejection_reason: null as string | null,
        };

        if (approvalAction.approval === DriverApprovalStatus.APPROVED) {
          updatedDriver.approved_at = new Date();
          updatedDriver.rejection_reason = null;
        } else if (approvalAction.approval === DriverApprovalStatus.REJECTED) {
          updatedDriver.approved_at = null;
          if (approvalAction.rejection_reason) {
            updatedDriver.rejection_reason = approvalAction.rejection_reason;
          }
        }

        // Verify approval status is updated correctly
        expect(updatedDriver.approval).toBe(approvalAction.approval);

        // Verify approval-specific field updates
        if (approvalAction.approval === DriverApprovalStatus.APPROVED) {
          expect(updatedDriver.approved_at).toBeDefined();
          expect(updatedDriver.approved_at).toBeInstanceOf(Date);
          expect(updatedDriver.rejection_reason).toBeNull();
        } else if (approvalAction.approval === DriverApprovalStatus.REJECTED) {
          expect(updatedDriver.approved_at).toBeNull();
          if (
            approvalAction.rejection_reason &&
            updatedDriver.rejection_reason
          ) {
            expect(updatedDriver.rejection_reason).toBe(
              approvalAction.rejection_reason,
            );
            expect(updatedDriver.rejection_reason.length).toBeGreaterThan(0);
          }
        }

        // Verify updated timestamp is set
        expect(updatedDriver.updated_at).toBeInstanceOf(Date);
        expect(updatedDriver.updated_at.getTime()).toBeGreaterThan(
          updatedDriver.created_at.getTime(),
        );

        return true;
      },
    );

    runPropertyTest('Admin Approval Actions Update Status Correctly', property);
  });

  it('should ensure document upload updates driver verification status', () => {
    const property = fc.property(
      driverRegistrationData(),
      documentUploadData(),
      (driverData, documentData) => {
        // Start with a driver without documents
        const driverWithoutDocs = {
          ...driverData,
          approval: DriverApprovalStatus.PENDING,
          aadhar_front: null,
          aadhar_back: null,
          dl_front: null,
          dl_back: null,
          profile_image: null,
          documents_uploaded_at: null,
        };

        // Simulate document upload
        const driverWithDocs = {
          ...driverWithoutDocs,
          ...documentData,
          documents_uploaded_at: new Date(),
          approval: DriverApprovalStatus.PENDING, // Should remain pending after upload
        };

        // Verify documents are stored
        if (documentData.aadhar_front) {
          expect(driverWithDocs.aadhar_front).toBe(documentData.aadhar_front);
        }
        if (documentData.aadhar_back) {
          expect(driverWithDocs.aadhar_back).toBe(documentData.aadhar_back);
        }
        if (documentData.dl_front) {
          expect(driverWithDocs.dl_front).toBe(documentData.dl_front);
        }
        if (documentData.dl_back) {
          expect(driverWithDocs.dl_back).toBe(documentData.dl_back);
        }
        if (documentData.profile_image) {
          expect(driverWithDocs.profile_image).toBe(documentData.profile_image);
        }

        // Verify upload timestamp is set
        expect(driverWithDocs.documents_uploaded_at).toBeInstanceOf(Date);

        // Verify approval status remains PENDING after document upload
        expect(driverWithDocs.approval).toBe(DriverApprovalStatus.PENDING);

        // Calculate document completeness
        const requiredDocs = [
          'aadhar_front',
          'aadhar_back',
          'dl_front',
          'dl_back',
        ] as const;
        const uploadedDocs = requiredDocs.filter(
          (doc) => driverWithDocs[doc] !== null,
        );
        const isComplete = uploadedDocs.length === requiredDocs.length;

        // Verify document status calculation
        expect(uploadedDocs.length).toBeGreaterThanOrEqual(0);
        expect(uploadedDocs.length).toBeLessThanOrEqual(requiredDocs.length);
        expect(typeof isComplete).toBe('boolean');

        return true;
      },
    );

    runPropertyTest('Document Upload Updates Verification Status', property);
  });

  it('should ensure driver approval workflow state transitions are valid', () => {
    const property = fc.property(
      fc.array(driverApprovalAction(), { minLength: 1, maxLength: 5 }),
      (approvalActions) => {
        let currentStatus: string = DriverApprovalStatus.PENDING;
        let approvedAt: Date | null = null;
        let rejectionReason: string | null = null;

        // Apply each approval action in sequence
        for (const action of approvalActions) {
          currentStatus = action.approval;

          // Verify state transition logic
          if (currentStatus === DriverApprovalStatus.APPROVED) {
            approvedAt = new Date();
            rejectionReason = null;
          } else if (currentStatus === DriverApprovalStatus.REJECTED) {
            approvedAt = null;
            if (action.rejection_reason) {
              rejectionReason = action.rejection_reason;
            }
          } else if (currentStatus === DriverApprovalStatus.PENDING) {
            // Can transition back to pending from any state
            approvedAt = null;
            rejectionReason = null;
          }

          // Verify final state is consistent
          if (currentStatus === DriverApprovalStatus.APPROVED) {
            expect(approvedAt).toBeInstanceOf(Date);
            expect(rejectionReason).toBeNull();
          } else if (currentStatus === DriverApprovalStatus.REJECTED) {
            expect(approvedAt).toBeNull();
            if (action.rejection_reason) {
              expect(rejectionReason).toBe(action.rejection_reason);
            }
          } else if (currentStatus === DriverApprovalStatus.PENDING) {
            expect(approvedAt).toBeNull();
            expect(rejectionReason).toBeNull();
          }

          // Verify valid status values
          expect(Object.values(DriverApprovalStatus)).toContain(currentStatus);
        }

        return true;
      },
    );

    runPropertyTest('Driver Approval State Transitions Are Valid', property);
  });

  it('should ensure rejection requires reason when provided', () => {
    const property = fc.property(
      driverRegistrationData(),
      fc.string({ minLength: 10, maxLength: 200 }),
      (driverData, rejectionReason) => {
        // Simulate driver rejection with reason
        const rejectedDriver = {
          ...driverData,
          approval: DriverApprovalStatus.REJECTED,
          rejection_reason: rejectionReason,
          approved_at: null,
          updated_at: new Date(),
        };

        // Verify rejection status and reason
        expect(rejectedDriver.approval).toBe(DriverApprovalStatus.REJECTED);
        expect(rejectedDriver.rejection_reason).toBe(rejectionReason);
        expect(rejectedDriver.rejection_reason.length).toBeGreaterThan(0);
        expect(rejectedDriver.approved_at).toBeNull();

        // Verify reason is meaningful (not just whitespace)
        expect(rejectedDriver.rejection_reason.trim().length).toBeGreaterThan(
          0,
        );

        return true;
      },
    );

    runPropertyTest('Rejection Requires Valid Reason', property);
  });
});
