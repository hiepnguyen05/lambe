class ProviderApplicationUpdate {
  final String email;
  final String biography;
  final String? legalFullName;
  final String? birthDate;
  final String? gender;
  final String? nationalIdNumber;
  final int? experienceYears;
  final String? organizationName;
  final String? taxCode;
  final String? businessRegistrationNumber;
  final String? registeredAddress;
  final String? representativeName;

  const ProviderApplicationUpdate({
    required this.email,
    required this.biography,
    this.legalFullName,
    this.birthDate,
    this.gender,
    this.nationalIdNumber,
    this.experienceYears,
    this.organizationName,
    this.taxCode,
    this.businessRegistrationNumber,
    this.registeredAddress,
    this.representativeName,
  });
}
