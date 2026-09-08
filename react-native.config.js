module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.feedbackjar.rnsdk.FeedbackJarAppInfoPackage;',
        packageInstance: 'new FeedbackJarAppInfoPackage()',
      },
      ios: {},
    },
  },
};
