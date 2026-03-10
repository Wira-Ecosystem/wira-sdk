#import "WiraSdk.h"
#import <React/RCTBridgeModule.h>
#import <React/RCTBridge.h>
#import <Flutter/Flutter.h>

@interface WiraSdk () <RCTBridgeModule>
@end

@implementation WiraSdk

RCT_EXPORT_MODULE()

@synthesize bridge = _bridge;

static FlutterEngine *sharedEngine = nil;
static FlutterMethodChannel *sharedChannel = nil;

+ (BOOL)requiresMainQueueSetup { return NO; }

- (void)ensureEngine {
    if (sharedEngine != nil) return;

    sharedEngine = [[FlutterEngine alloc] initWithName:@"wira_logic_engine" project:nil];
    [sharedEngine runWithEntrypoint:@"main"];

    sharedChannel = [FlutterMethodChannel
        methodChannelWithName:@"wira_logic"
              binaryMessenger:sharedEngine.binaryMessenger];

    __weak RCTBridge *weakBridge = self.bridge;
    [sharedChannel setMethodCallHandler:^(FlutterMethodCall *call, FlutterResult result) {
        if ([call.method isEqualToString:@"downloadInfo"]) {
            NSString *args = call.arguments ?: @"";
            [weakBridge enqueueJSCall:@"RCTDeviceEventEmitter"
                               method:@"emit"
                                 args:@[@"downloadInfo", args]
                           completion:NULL];
            result(nil);
        } else {
            result(FlutterMethodNotImplemented);
        }
    }];
}

- (void)callFunction:(NSString *)functionName
                args:(NSDictionary *)args
            resolver:(RCTPromiseResolveBlock)resolve
            rejecter:(RCTPromiseRejectBlock)reject
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [self ensureEngine];

        [sharedChannel invokeMethod:functionName
                          arguments:args
                             result:^(id _Nullable result) {
            if ([result isKindOfClass:[FlutterError class]]) {
                FlutterError *error = (FlutterError *)result;
                reject(error.code, error.message, nil);
            } else if (result == FlutterMethodNotImplemented) {
                reject(@"NOT_IMPLEMENTED",
                       [NSString stringWithFormat:@"%@ not implemented in Flutter logic", functionName],
                       nil);
            } else {
                resolve(result);
            }
        }];
    });
}

- (void)initialize:(NSString *)env
          resolver:(RCTPromiseResolveBlock)resolve
          rejecter:(RCTPromiseRejectBlock)reject
{
    [self callFunction:@"initialize"
                  args:@{ @"env": env }
              resolver:resolve
              rejecter:reject];
}

- (void)downloadCircuits:(NSString *)circuitsToDownload
                resolver:(RCTPromiseResolveBlock)resolve
                rejecter:(RCTPromiseRejectBlock)reject
{
    [self callFunction:@"downloadCircuits"
                  args:@{ @"circuitsToDownload": circuitsToDownload }
              resolver:resolve
              rejecter:reject];
}

- (void)addIdentity:(RCTPromiseResolveBlock)resolve
           rejecter:(RCTPromiseRejectBlock)reject
{
    [self callFunction:@"addIdentity"
                  args:@{}
              resolver:resolve
              rejecter:reject];
}

- (void)authenticate:(NSString *)message
             userDid:(NSString *)userDid
              userPk:(NSString *)userPk
            resolver:(RCTPromiseResolveBlock)resolve
            rejecter:(RCTPromiseRejectBlock)reject
{
    NSDictionary *args = @{
        @"message": message,
        @"userDid": userDid,
        @"userPk": userPk
    };
    [self callFunction:@"authenticate" args:args resolver:resolve rejecter:reject];
}

- (void)claimCredential:(NSString *)offerMessage
                userDid:(NSString *)userDid
                 userPk:(NSString *)userPk
               resolver:(RCTPromiseResolveBlock)resolve
               rejecter:(RCTPromiseRejectBlock)reject
{
    NSDictionary *args = @{
        @"offerMessage": offerMessage,
        @"userDid": userDid,
        @"userPk": userPk
    };
    [self callFunction:@"claimCredential" args:args resolver:resolve rejecter:reject];
}

- (void)backupIdentity:(NSString *)userDid
                userPk:(NSString *)userPk
              resolver:(RCTPromiseResolveBlock)resolve
              rejecter:(RCTPromiseRejectBlock)reject
{
    NSDictionary *args = @{
        @"userDid": userDid,
        @"userPk": userPk
    };
    [self callFunction:@"backupIdentity" args:args resolver:resolve rejecter:reject];
}

- (void)restoreIdentity:(NSString *)backup
                userDid:(NSString *)userDid
                 userPk:(NSString *)userPk
               resolver:(RCTPromiseResolveBlock)resolve
               rejecter:(RCTPromiseRejectBlock)reject
{
    NSDictionary *args = @{
        @"backup": backup,
        @"userDid": userDid,
        @"userPk": userPk
    };
    [self callFunction:@"restoreIdentity" args:args resolver:resolve rejecter:reject];
}

- (void)getCredentials:(NSString *)userDid
                userPk:(NSString *)userPk
              resolver:(RCTPromiseResolveBlock)resolve
              rejecter:(RCTPromiseRejectBlock)reject
{
    NSDictionary *args = @{
        @"userDid": userDid,
        @"userPk": userPk
    };
    [self callFunction:@"getCredentials" args:args resolver:resolve rejecter:reject];
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeWiraSdkSpecJSI>(params);
}

@end
