import { Construct } from "constructs";
import * as eks from "aws-cdk-lib/aws-eks";
import * as iam from "aws-cdk-lib/aws-iam";

export interface ClusterAutoScalerProps {
  cluster: eks.Cluster;
}

export class ClusterAutoscaler extends Construct {
  constructor(scope: Construct, id: string, props: ClusterAutoScalerProps) {
    super(scope, id);

    const caServiceAccount = props.cluster.addServiceAccount(
      "cluster-autoscaler",
      {
        name: "cluster-autoscaler",
        namespace: "kube-system",
      }
    );

    caServiceAccount.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
          "autoscaling:DescribeAutoScalingGroups",
          "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeLaunchConfigurations",
          "autoscaling:DescribeTags",
          "autoscaling:SetDesiredCapacity",
          "autoscaling:TerminateInstanceInAutoScalingGroup",
          "ec2:DescribeLaunchTemplateVersions",
        ],
      })
    );

    props.cluster.addHelmChart("ClusterAutoscaler", {
      chart: "cluster-autoscaler",
      release: "cluster-autoscaler",
      repository: "https://kubernetes.github.io/autoscaler",
      values: {
        rbac: {
          serviceAccount: {
            create: false,
            name: "cluster-autoscaler",
          },
        },
        autoDiscovery: {
          clusterName: props.cluster.clusterName,
        },
        extraArgs: {
          "skip-nodes-with-local-storage": "false",
          "skip-nodes-with-system-pods": "false",
        },
        podDisruptionBudget: {
          enabled: true,
        },
      },
      version: "9.29.0",
      namespace: "kube-system",
    });

    props.cluster.addHelmChart("MetricsServer", {
      chart: "metrics-server",
      release: "metrics-server",
      repository: "https://charts.bitnami.com/bitnami",
      version: "5.9.3",
      namespace: "kube-system",
      values: {
        args: [
          "--kubelet-insecure-tls",
          "--kubelet-preferred-address-types=InternalIP",
        ],
      },
    });
  }
}
