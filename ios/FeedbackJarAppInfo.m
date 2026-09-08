#import <React/RCTBridgeModule.h>

@interface FeedbackJarAppInfo : NSObject <RCTBridgeModule>
@end

@implementation FeedbackJarAppInfo

RCT_EXPORT_MODULE();

- (NSDictionary *)constantsToExport
{
  NSBundle *bundle = [NSBundle mainBundle];
  NSString *bundleId = bundle.bundleIdentifier ?: @"";

  return @{
    @"bundleId": bundleId,
    @"packageName": bundleId,
    @"version": bundle.infoDictionary[@"CFBundleShortVersionString"] ?: @"unknown",
    @"build": bundle.infoDictionary[@"CFBundleVersion"] ?: @"unknown",
  };
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
