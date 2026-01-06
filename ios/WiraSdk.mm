#import "WiraSdk.h"
#import <React/RCTBridgeModule.h>
#import <Flutter/Flutter.h>

@interface WiraSdk() <RCTBridgeModule>
@end

@implementation WiraSdk
RCT_EXPORT_MODULE()

static FlutterEngine *sharedEngine = nil;
static FlutterMethodChannel *sharedChannel = nil;

+ (void)ensureEngine {
	if (sharedEngine != nil) return;

	sharedEngine = [[FlutterEngine alloc] initWithName:@"wira_logic_engine" project:nil];

	// Run default main() in main.dart
	[sharedEngine runWithEntrypoint:@"main"];

	sharedChannel = [FlutterMethodChannel methodChannelWithName:@"wira_logic"
                                            binaryMessenger:sharedEngine.binaryMessenger];
}

RCT_EXPORT_METHOD(multiply:(double)a
                  b:(double)b
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
	[WiraModule ensureEngine];

	NSDictionary *args = @{ @"a": @(a), @"b": @(b) };

	[sharedChannel invokeMethod:@"multiply"
						arguments:args
						result:^(id _Nullable result) {
		if ([result isKindOfClass:[NSNumber class]]) {
		    resolve(result);
		} else if (result == nil) {
		    reject(@"NO_RESULT", @"No result from Flutter multiply", nil);
		} else {
		    reject(@"BAD_RESULT", @"Unexpected result type from Flutter multiply", nil);
		}
	}];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeWiraSdkSpecJSI>(params);
}

@end
