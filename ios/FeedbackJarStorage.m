#import <React/RCTBridgeModule.h>

@interface FeedbackJarStorage : NSObject <RCTBridgeModule>
@end

@implementation FeedbackJarStorage

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getItem:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve([[NSUserDefaults standardUserDefaults] stringForKey:key]);
}

RCT_EXPORT_METHOD(setItem:(NSString *)key
                  value:(NSString *)value
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[NSUserDefaults standardUserDefaults] setObject:value forKey:key];
  resolve(nil);
}

RCT_EXPORT_METHOD(removeItem:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[NSUserDefaults standardUserDefaults] removeObjectForKey:key];
  resolve(nil);
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
