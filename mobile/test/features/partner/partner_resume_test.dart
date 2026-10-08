import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/domain/value_objects/upload_payload.dart';
import 'package:mobile/features/partner/data/datasources/partner_remote_datasource.dart';
import 'package:mobile/features/partner/data/models/partner_api_model.dart';
import 'package:mobile/features/partner/data/repositories/partner_repository_impl.dart';
import 'package:mobile/features/partner/domain/entities/provider_application_entity.dart';

void main() {
  group('partner application resume', () {
    test('loads full details for the latest application', () async {
      final remote = _FakePartnerRemoteDataSource();
      final repository = PartnerRepositoryImpl(remote);

      final application = await repository.getLatestApplication();

      expect(remote.requestedApplicationId, 'draft-1');
      expect(application?.email, 'partner@lambe.vn');
      expect(application?.nationalIdMasked, '********1234');
      expect(application?.resumeStep, PartnerApplicationStep.services);
    });

    test('chooses the first incomplete registration step', () {
      expect(_application().resumeStep, PartnerApplicationStep.info);
      expect(
        _application(profileComplete: true).resumeStep,
        PartnerApplicationStep.services,
      );
      expect(
        _application(profileComplete: true, serviceCount: 1).resumeStep,
        PartnerApplicationStep.identity,
      );
      expect(
        _application(
          profileComplete: true,
          serviceCount: 1,
          documentTypes: const [
            'PORTRAIT',
            'ID_CARD_FRONT',
            'ID_CARD_BACK',
            'IDENTITY_SELFIE',
          ],
        ).resumeStep,
        PartnerApplicationStep.submit,
      );
    });

    test('uses service settings for professional evidence requirements', () {
      const requirements = [
        ProviderApplicationServiceRequirement(
          applicationServiceId: 'application-service-1',
          serviceId: 'service-1',
          name: 'Cắt tóc nam',
          status: 'PENDING',
          requiresCertificate: true,
          minPortfolioImages: 3,
          minExperienceYears: 1,
        ),
        ProviderApplicationServiceRequirement(
          applicationServiceId: 'application-service-2',
          serviceId: 'service-2',
          name: 'Uốn tóc nam',
          status: 'PENDING',
          requiresCertificate: false,
          minPortfolioImages: 5,
          minExperienceYears: 2,
        ),
      ];

      final missingEvidence = _application(
        profileComplete: true,
        serviceCount: 2,
        documentTypes: const [
          'PORTRAIT',
          'ID_CARD_FRONT',
          'ID_CARD_BACK',
          'IDENTITY_SELFIE',
        ],
        registeredServices: requirements,
      );
      final completeEvidence = _application(
        profileComplete: true,
        serviceCount: 2,
        documentTypes: const [
          'PORTRAIT',
          'ID_CARD_FRONT',
          'ID_CARD_BACK',
          'IDENTITY_SELFIE',
          'PROFESSIONAL_CERTIFICATE',
          'PORTFOLIO',
        ],
        certificateDocumentCount: 1,
        portfolioDocumentCount: 5,
        registeredServices: requirements,
      );

      expect(missingEvidence.requiredPortfolioImages, 5);
      expect(missingEvidence.resumeStep, PartnerApplicationStep.expertise);
      expect(completeEvidence.resumeStep, PartnerApplicationStep.submit);
    });

    test('maps detailed progress and ignores rejected documents', () {
      final application = PartnerApiModel.applicationFromJson({
        'id': 'draft-1',
        'providerType': 'INDIVIDUAL',
        'status': 'DRAFT',
        'submittedAt': '2026-10-07T10:30:00.000Z',
        'birthDate': '1995-02-03T00:00:00.000Z',
        'nationalIdMasked': '********1234',
        'documents': [
          {'type': 'PORTRAIT', 'status': 'PENDING'},
          {'type': 'ID_CARD_FRONT', 'status': 'REJECTED'},
        ],
        'services': [
          {
            'id': 'application-service-1',
            'status': 'PENDING',
            'service': {
              'id': 'service-1',
              'name': 'Cắt tóc nam',
              'requiresCertificate': true,
              'minPortfolioImages': 3,
              'minExperienceYears': 1,
            },
          },
        ],
        'serviceSuggestions': <dynamic>[],
        'termsAcceptances': [
          {'id': 'terms-1'},
        ],
      });

      expect(application.birthDate, '1995-02-03');
      expect(application.documentTypes, ['PORTRAIT']);
      expect(application.serviceCount, 1);
      expect(application.requiresProfessionalCertificate, isTrue);
      expect(application.requiredPortfolioImages, 3);
      expect(application.hasAcceptedTerms, isTrue);
      expect(application.submittedAt, '2026-10-07T10:30:00.000Z');
    });

    test('prioritizes the section that needs correction', () {
      final application = ProviderApplicationEntity(
        id: 'needs-changes-1',
        providerType: 'INDIVIDUAL',
        status: 'NEEDS_CHANGES',
        email: 'partner@lambe.vn',
        legalFullName: 'Nguyen Van A',
        birthDate: '1995-02-03',
        nationalIdMasked: '********1234',
        experienceYears: 3,
        serviceCount: 1,
        documentTypes: const [
          'PORTRAIT',
          'ID_CARD_FRONT',
          'ID_CARD_BACK',
          'IDENTITY_SELFIE',
          'PORTFOLIO',
        ],
        correctionSections: const ['SERVICES'],
      );

      expect(application.resumeStep, PartnerApplicationStep.services);
    });
  });
}

ProviderApplicationEntity _application({
  bool profileComplete = false,
  int serviceCount = 0,
  List<String> documentTypes = const [],
  int portfolioDocumentCount = 0,
  int certificateDocumentCount = 0,
  List<ProviderApplicationServiceRequirement> registeredServices = const [],
}) {
  return ProviderApplicationEntity(
    id: 'draft-1',
    providerType: 'INDIVIDUAL',
    status: 'DRAFT',
    email: profileComplete ? 'partner@lambe.vn' : null,
    legalFullName: profileComplete ? 'Nguyen Van A' : null,
    birthDate: profileComplete ? '1995-02-03' : null,
    nationalIdMasked: profileComplete ? '********1234' : null,
    experienceYears: profileComplete ? 3 : null,
    serviceCount: serviceCount,
    documentTypes: documentTypes,
    portfolioDocumentCount: portfolioDocumentCount,
    certificateDocumentCount: certificateDocumentCount,
    registeredServices: registeredServices,
  );
}

class _FakePartnerRemoteDataSource implements PartnerRemoteDataSource {
  String? requestedApplicationId;

  @override
  Future<List<dynamic>> getMyApplications() async => [
    {
      'id': 'draft-1',
      'providerType': 'INDIVIDUAL',
      'status': 'DRAFT',
      '_count': {'documents': 0, 'services': 0, 'serviceSuggestions': 0},
    },
  ];

  @override
  Future<Map<String, dynamic>> getApplication(String id) async {
    requestedApplicationId = id;
    return {
      'id': id,
      'providerType': 'INDIVIDUAL',
      'status': 'DRAFT',
      'email': 'partner@lambe.vn',
      'legalFullName': 'Nguyen Van A',
      'birthDate': '1995-02-03T00:00:00.000Z',
      'nationalIdMasked': '********1234',
      'experienceYears': 3,
      'documents': <dynamic>[],
      'services': <dynamic>[],
      'serviceSuggestions': <dynamic>[],
      'termsAcceptances': <dynamic>[],
    };
  }

  @override
  Future<Map<String, dynamic>> createApplication(String providerType) =>
      throw UnimplementedError();

  @override
  Future<List<dynamic>> getAllServices() => throw UnimplementedError();

  @override
  Future<void> updateApplication(String id, Map<String, dynamic> data) =>
      throw UnimplementedError();

  @override
  Future<void> addService(String id, Map<String, dynamic> service) =>
      throw UnimplementedError();

  @override
  Future<void> suggestService(String id, Map<String, dynamic> data) =>
      throw UnimplementedError();

  @override
  Future<void> uploadDocument(String id, String type, UploadPayload upload) =>
      throw UnimplementedError();

  @override
  Future<void> acceptTerms(String id) => throw UnimplementedError();

  @override
  Future<void> submitApplication(String id) => throw UnimplementedError();
}
