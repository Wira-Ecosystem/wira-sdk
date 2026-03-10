#import <WiraSdkSpec/WiraSdkSpec.h>

@interface WiraSdk : NSObject <NativeWiraSdkSpec>

- (void)ensureEngine;

@end
